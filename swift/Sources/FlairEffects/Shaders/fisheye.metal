// flair-metal-hash: 560078f3
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uStrength;
    float uZoom;
    uint uLens;
    float uRadius;
    float uVignette;
    char _m18_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_fisheye_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _53)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_53.uBackdrop) * _53.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_53.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _53)
{
    float4 _197;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _197 = overBackdrop(param, _53);
    }
    else
    {
        float2 param_1 = fract(uv);
        _197 = float4(testCard(param_1), 1.0);
    }
    return _197;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _53, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 mid = float2(_53.iResolution[0], _53.iResolution[1]) * 0.5;
    float2 d = fragCoord - mid;
    float _232;
    if (_53.uLens != 0u)
    {
        _232 = _53.uRadius * _53.iResolution[1u];
    }
    else
    {
        _232 = 0.5 * length(float2(_53.iResolution[0], _53.iResolution[1]));
    }
    float unit = _232;
    float r = length(d) / unit;
    float2 param = fragCoord / float2(_53.iResolution[0], _53.iResolution[1]);
    float4 col = pictureRGBA(uImage, uImageSmplr, param, _53);
    if (r < 1.0)
    {
        float fov = mix(0.0199999995529651641845703125, 2.900000095367431640625, _53.uStrength);
        float src = tan((r * 0.5) * fov) / tan(0.5 * fov);
        float2 p = mid + ((((d / float2(fast::max(length(d), 9.9999997473787516355514526367188e-06))) * src) * unit) / float2(_53.uZoom));
        float2 param_1 = p / float2(_53.iResolution[0], _53.iResolution[1]);
        float4 lens = pictureRGBA(uImage, uImageSmplr, param_1, _53);
        float4 _318 = lens;
        float3 _320 = _318.xyz * (1.0 - (_53.uVignette * powr(r, 2.5)));
        lens.x = _320.x;
        lens.y = _320.y;
        lens.z = _320.z;
        float _332;
        if (_53.uLens != 0u)
        {
            _332 = 1.0 - smoothstep(1.0 - (2.0 / unit), 1.0, r);
        }
        else
        {
            _332 = 1.0;
        }
        float edge = _332;
        col = mix(col, lens, float4(edge));
    }
    if (_53.uLens != 0u)
    {
        float rim = exp(-powr(((r - 1.0) * unit) / fast::max(unit * 0.0199999995529651641845703125, 1.5), 2.0));
        float4 _367 = col;
        float3 _374 = mix(_367.xyz, float3(0.0599999986588954925537109375), float3(rim * 0.60000002384185791015625));
        col.x = _374.x;
        col.y = _374.y;
        col.z = _374.z;
    }
    else
    {
        float4 _388 = col;
        float3 _390 = _388.xyz * (1.0 - (_53.uVignette * smoothstep(0.980000019073486328125, 1.0, r)));
        col.x = _390.x;
        col.y = _390.y;
        col.z = _390.z;
    }
    fragColor = col;
}

fragment flair_fisheye_frag_out flair_fisheye_frag(constant FlairUniforms& _53 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_fisheye_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _411;
    if (_53.flair_flipY > 0.5)
    {
        _411 = _53.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _411 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _411);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _53, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}


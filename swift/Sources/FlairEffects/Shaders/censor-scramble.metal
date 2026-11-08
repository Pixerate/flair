// flair-metal-hash: d11a0755
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
    float uBlock;
    float uReach;
    float uRate;
    float uNoise;
    float2 uCentre;
    float2 uSize;
    int uShape;
    float uFeather;
    uint uInvert;
    char _m22_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_censor_scramble_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _122)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_122.uBackdrop) * _122.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_122.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _122)
{
    float4 _264;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _264 = overBackdrop(param, _122);
    }
    else
    {
        float2 param_1 = fract(uv);
        _264 = float4(testCard(param_1), 1.0);
    }
    return _264;
}

static inline __attribute__((always_inline))
float region(thread const float2& fragCoord, constant FlairUniforms& _122)
{
    float2 hs = fast::max((_122.uSize * 0.5) * float2(_122.iResolution[0], _122.iResolution[1]), float2(1.0));
    float2 p = fragCoord - (_122.uCentre * float2(_122.iResolution[0], _122.iResolution[1]));
    float d;
    if (_122.uShape == 0)
    {
        float2 q = abs(p) - hs;
        d = length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0);
    }
    else
    {
        d = (length(p / hs) - 1.0) * fast::min(hs.x, hs.y);
    }
    float m = 1.0 - smoothstep(((-0.5) * _122.uFeather) - 0.5, (0.5 * _122.uFeather) + 0.5, d);
    float _362;
    if (_122.uInvert != 0u)
    {
        _362 = 1.0 - m;
    }
    else
    {
        _362 = m;
    }
    return _362;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _122, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_122.iResolution[0], _122.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _122);
    float2 param_1 = fragCoord;
    float m = region(param_1, _122);
    if (m <= 0.0)
    {
        fragColor = pic;
        return;
    }
    float tick = floor(_122.iTime * _122.uRate);
    float2 cell = floor(fragCoord / float2(_122.uBlock));
    float2 param_2 = cell + float2(tick * 17.3099994659423828125);
    float2 src = cell + floor((((hash22(param_2) - float2(0.5)) * 2.0) * _122.uReach) + float2(0.5));
    float2 f = fract(fragCoord / float2(_122.uBlock));
    float2 param_3 = (cell * 3.099999904632568359375) + float2(tick * 0.730000019073486328125);
    float2 h = hash22(param_3);
    if (h.x < 0.5)
    {
        f.x = 1.0 - f.x;
    }
    if (h.y < 0.3499999940395355224609375)
    {
        f = f.yx;
    }
    float2 param_4 = ((src + f) * _122.uBlock) / float2(_122.iResolution[0], _122.iResolution[1]);
    float4 c = pictureRGBA(uImage, uImageSmplr, param_4, _122);
    float3 col = mix(c.xyz, floor((c.xyz * 5.0) + float3(0.5)) / float3(5.0), float3(_122.uNoise));
    float2 param_5 = cell + float2(tick * 5.69999980926513671875);
    float k = hash12(param_5);
    if (k < (0.119999997317790985107421875 * _122.uNoise))
    {
        float2 param_6 = floor(fragCoord / float2(2.0)) + float2(tick);
        col = float3(hash12(param_6));
    }
    else
    {
        if (k < (0.300000011920928955078125 * _122.uNoise))
        {
            col = col.yzx;
        }
    }
    fragColor = mix(pic, float4(col, c.w), float4(m));
}

fragment flair_censor_scramble_frag_out flair_censor_scramble_frag(constant FlairUniforms& _122 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_censor_scramble_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _554;
    if (_122.flair_flipY > 0.5)
    {
        _554 = _122.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _554 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _554);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _122, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}


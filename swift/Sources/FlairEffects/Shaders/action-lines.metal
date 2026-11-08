// flair-metal-hash: ed3ee4df
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
}

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
    float uAngle;
    float uDensity;
    float uCover;
    float uLength;
    float uSpeed;
    float uSmear;
    char _m19_pad[8];
    packed_float3 uLineColor;
    float uLineAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_action_lines_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _124)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_124.uBackdrop) * _124.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_124.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _124)
{
    float4 _266;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _266 = overBackdrop(param, _124);
    }
    else
    {
        float2 param_1 = fract(uv);
        _266 = float4(testCard(param_1), 1.0);
    }
    return _266;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _124)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _124).xyz;
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _124, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_124.iResolution[0], _124.iResolution[1]);
    float ang = radians(_124.uAngle);
    float2 dir = float2(cos(ang), sin(ang));
    float2 perp = float2(-dir.y, dir.x);
    float2 back = ((-dir) * _124.uSmear) * float2(_124.iResolution[1u] / _124.iResolution[0u], 1.0);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _124);
    float3 col = pic.xyz * 0.25;
    float total = 0.25;
    for (int i = 1; i < 8; i++)
    {
        float k = float(i) / 7.0;
        float w = 1.0 - (0.60000002384185791015625 * k);
        float2 param_1 = uv + (back * k);
        col += (picture(uImage, uImageSmplr, param_1, _124) * w);
        total += w;
    }
    col /= float3(total);
    float2 p = fragCoord - (float2(_124.iResolution[0], _124.iResolution[1]) * 0.5);
    float rowH = _124.iResolution[1u] / _124.uDensity;
    float acrossPx = dot(p, perp);
    float row = floor(acrossPx / rowH);
    float2 param_2 = float2(row, 3.7000000476837158203125);
    float2 h = hash22(param_2);
    float2 param_3 = float2(row, 9.1000003814697265625);
    float h3 = hash12(param_3);
    float present = step(1.0 - _124.uCover, h.x);
    float thick = rowH * (0.07999999821186065673828125 + (0.300000011920928955078125 * h3));
    float dist = abs(acrossPx - (((row + 0.5) + (0.300000011920928955078125 * (h.y - 0.5))) * rowH));
    float lineMask = fast::clamp(((thick * 0.5) - dist) + 0.5, 0.0, 1.0);
    float along = dot(p, dir) / _124.iResolution[0u];
    float span = (_124.uLength * (0.60000002384185791015625 + (0.800000011920928955078125 * h.y))) + 0.300000011920928955078125;
    float t = fract(((along - ((_124.iTime * _124.uSpeed) * (0.60000002384185791015625 + (0.800000011920928955078125 * h3)))) / span) + (h.x * 7.0));
    float seg = (_124.uLength * (0.60000002384185791015625 + (0.800000011920928955078125 * h.y))) / span;
    float streak = smoothstep(seg, seg * 0.85000002384185791015625, t) * smoothstep(0.0, seg * 0.89999997615814208984375, t);
    float m = ((present * lineMask) * streak) * _124.uLineAlpha;
    col = mix(col, float3(_124.uLineColor), float3(m));
    fragColor = float4(col, fast::max(pic.w, m));
}

fragment flair_action_lines_frag_out flair_action_lines_frag(constant FlairUniforms& _124 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_action_lines_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _551;
    if (_124.flair_flipY > 0.5)
    {
        _551 = _124.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _551 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _551);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _124, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}


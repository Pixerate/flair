// flair-metal-hash: f766bdf1
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    int uPattern;
    char _m14_pad[12];
    packed_float3 uColor;
    float uIntensity;
    float uAmbient;
    float uScale;
    float uAngle;
    float uSoftness;
    float uDrift;
    char _m21_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_gobo_projection_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float windowPanes(thread const float2& q, thread const float& s)
{
    float2 frame = abs(q) - float2(0.4199999868869781494140625, 0.3400000035762786865234375);
    float inside = smoothstep(s, -s, fast::max(frame.x, frame.y));
    float2 g = abs(fract((q + float2(0.4199999868869781494140625, 0.3400000035762786865234375)) / float2(0.2800000011920928955078125, 0.3400000035762786865234375)) - float2(0.5));
    float bar = 0.070000000298023223876953125 + (s * 0.5);
    float pane = smoothstep((0.5 - bar) - s, (0.5 - bar) + s, 0.5 - fast::max(g.x * 1.0, g.y));
    return inside * pane;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float foliage(thread const float2& q, thread const float& s, thread const float& t, constant FlairUniforms& _98)
{
    float2 sway = (float2(sin((t * 0.699999988079071044921875) + (q.y * 2.0)), cos((t * 0.5) + (q.x * 1.7000000476837158203125))) * 0.02999999932944774627685546875) * _98.uDrift;
    float2 param = ((q + sway) * 6.0) + float2(2.0);
    int param_1 = 5;
    float _522 = fbm(param, param_1);
    float n = _522;
    float w = 0.0199999995529651641845703125 + (s * 0.100000001490116119384765625);
    return smoothstep(0.5 - w, 0.5 + w, n);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float stars(thread const float2& q, thread const float& s)
{
    float2 cell = floor(q / float2(0.20000000298023223876953125));
    float2 f = fract(q / float2(0.20000000298023223876953125)) - float2(0.5);
    float2 param = cell + float2(3.099999904632568359375);
    float2 h = hash22(param);
    f -= ((h - float2(0.5)) * 0.3499999940395355224609375);
    float param_1 = h.x * 6.280000209808349609375;
    f = rot(param_1) * f;
    float r = length(f);
    float a = precise::atan2(f.y, f.x);
    float edge = (0.1599999964237213134765625 + (0.119999997317790985107421875 * h.y)) * (0.550000011920928955078125 + (0.449999988079071044921875 * powr(abs(cos(2.5 * a)), 3.0)));
    float2 param_2 = cell + float2(7.69999980926513671875);
    float keep = step(0.25, hash12(param_2));
    return keep * smoothstep((edge + 0.0199999995529651641845703125) + (s * 0.119999997317790985107421875), (edge - 0.0199999995529651641845703125) - (s * 0.0500000007450580596923828125), r);
}

static inline __attribute__((always_inline))
float slats(thread const float2& q, thread const float& s)
{
    float f = fract(q.y * 8.0);
    float w = 0.039999999105930328369140625 + (s * 0.25);
    float lit = smoothstep(0.0, w, f) * smoothstep(0.62000000476837158203125 + w, 0.62000000476837158203125, f);
    return lit * smoothstep(0.5 + (s * 0.100000001490116119384765625), 0.439999997615814208984375, abs(q.x));
}

static inline __attribute__((always_inline))
float goboImage(thread const float2& q, thread const float& s, texture2d<float> uGobo, sampler uGoboSmplr)
{
    int2 size = int2(uGobo.get_width(), uGobo.get_height());
    if (size.x <= 1)
    {
        return 0.0;
    }
    float aspect = float(size.x) / float(size.y);
    float w = fast::min(1.2999999523162841796875, 1.2999999523162841796875 * aspect);
    float2 g = (q / float2(w, w / aspect)) + float2(0.5);
    bool _690 = g.x < 0.0;
    bool _697;
    if (!_690)
    {
        _697 = g.x > 1.0;
    }
    else
    {
        _697 = _690;
    }
    bool _704;
    if (!_697)
    {
        _704 = g.y < 0.0;
    }
    else
    {
        _704 = _697;
    }
    bool _711;
    if (!_704)
    {
        _711 = g.y > 1.0;
    }
    else
    {
        _711 = _704;
    }
    if (_711)
    {
        return 0.0;
    }
    return uGobo.sample(uGoboSmplr, g, level(log2(1.0 + ((s * 0.02999999932944774627685546875) * float(size.y))))).w;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _98)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_98.uBackdrop) * _98.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_98.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _98)
{
    float4 _242;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _242 = overBackdrop(param, _98);
    }
    else
    {
        float2 param_1 = fract(uv);
        _242 = float4(testCard(param_1), 1.0);
    }
    return _242;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _98, texture2d<float> uGobo, sampler uGoboSmplr, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_98.iResolution[0], _98.iResolution[1]);
    float2 p = (fragCoord - (float2(_98.iResolution[0], _98.iResolution[1]) * 0.5)) / float2(_98.iResolution[1u]);
    float t = _98.iTime;
    float2 shift = (float2(sin(t * 0.12999999523162841796875), cos(t * 0.10999999940395355224609375)) * 0.0500000007450580596923828125) * _98.uDrift;
    float param = radians(_98.uAngle) + ((sin(t * 0.0900000035762786865234375) * 0.0599999986588954925537109375) * _98.uDrift);
    float2 q = (rot(param) * (p - shift)) / float2(_98.uScale);
    float s = _98.uSoftness * 0.0599999986588954925537109375;
    float _799;
    if (_98.uPattern == 0)
    {
        float2 param_1 = q;
        float param_2 = s;
        _799 = windowPanes(param_1, param_2);
    }
    else
    {
        float _811;
        if (_98.uPattern == 1)
        {
            float2 param_3 = q;
            float param_4 = _98.uSoftness;
            float param_5 = t;
            _811 = foliage(param_3, param_4, param_5, _98);
        }
        else
        {
            float _827;
            if (_98.uPattern == 2)
            {
                float2 param_6 = q;
                float param_7 = s;
                _827 = stars(param_6, param_7);
            }
            else
            {
                float _840;
                if (_98.uPattern == 3)
                {
                    float2 param_8 = q;
                    float param_9 = _98.uSoftness;
                    _840 = slats(param_8, param_9);
                }
                else
                {
                    float2 param_10 = q;
                    float param_11 = _98.uSoftness;
                    _840 = goboImage(param_10, param_11, uGobo, uGoboSmplr);
                }
                _827 = _840;
            }
            _811 = _827;
        }
        _799 = _811;
    }
    float lit = _799;
    float beam = 1.0 - smoothstep(0.449999988079071044921875, 0.85000002384185791015625 + (0.20000000298023223876953125 * _98.uSoftness), length(q * float2(0.75, 1.0)));
    float2 param_12 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_12, _98);
    float3 light = mix(float3(_98.uAmbient) * float3(0.920000016689300537109375, 0.949999988079071044921875, 1.0), float3(_98.uColor) * _98.uIntensity, float3(lit * beam));
    float3 col = pic.xyz * light;
    fragColor = float4(col / (float3(1.0) + fast::max(col - float3(1.0), float3(0.0))), pic.w);
}

fragment flair_gobo_projection_frag_out flair_gobo_projection_frag(constant FlairUniforms& _98 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uGobo [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uGoboSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_gobo_projection_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _929;
    if (_98.flair_flipY > 0.5)
    {
        _929 = _98.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _929 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _929);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _98, uGobo, uGoboSmplr, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}


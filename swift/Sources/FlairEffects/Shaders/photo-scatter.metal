// flair-metal-hash: 5676c0e4
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    int uCount;
    float uPrint;
    float uAspect;
    float uSpread;
    float uTilt;
    float uDeal;
    float uHold;
    float uFocusScale;
    float uSeed;
    char _m22_pad[12];
    packed_float3 uBorder;
    float uShadow;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_photo_scatter_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float ease(thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    return (t * t) * (3.0 - (2.0 * t));
}

static inline __attribute__((always_inline))
float hash11(thread const float& n)
{
    return fract(sin((n * 127.09999847412109375) + 11.69999980926513671875) * 43758.546875);
}

static inline __attribute__((always_inline))
float easeOut(thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    return 1.0 - (((1.0 - t) * (1.0 - t)) * (1.0 - t));
}

static inline __attribute__((always_inline))
float2x2 rot2(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float tileBox(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
int2 itemSize(thread const int& i, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        return int2(uItem0.get_width(), uItem0.get_height());
    }
    if (i == 1)
    {
        return int2(uItem1.get_width(), uItem1.get_height());
    }
    if (i == 2)
    {
        return int2(uItem2.get_width(), uItem2.get_height());
    }
    if (i == 3)
    {
        return int2(uItem3.get_width(), uItem3.get_height());
    }
    if (i == 4)
    {
        return int2(uItem4.get_width(), uItem4.get_height());
    }
    return int2(uItem5.get_width(), uItem5.get_height());
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _111)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_111.uBackdrop) * _111.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_111.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _111)
{
    float4 _254;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _254 = overBackdrop(param, _111);
    }
    else
    {
        float2 param_1 = fract(uv);
        _254 = float4(testCard(param_1), 1.0);
    }
    return _254;
}

static inline __attribute__((always_inline))
float4 itemAt(thread const int& i, thread const float2& uv, constant FlairUniforms& _111, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        float2 param = uv;
        return pictureRGBA(uItem0, uItem0Smplr, param, _111);
    }
    if (i == 1)
    {
        float2 param_1 = uv;
        return pictureRGBA(uItem1, uItem1Smplr, param_1, _111);
    }
    if (i == 2)
    {
        float2 param_2 = uv;
        return pictureRGBA(uItem2, uItem2Smplr, param_2, _111);
    }
    if (i == 3)
    {
        float2 param_3 = uv;
        return pictureRGBA(uItem3, uItem3Smplr, param_3, _111);
    }
    if (i == 4)
    {
        float2 param_4 = uv;
        return pictureRGBA(uItem4, uItem4Smplr, param_4, _111);
    }
    float2 param_5 = uv;
    return pictureRGBA(uItem5, uItem5Smplr, param_5, _111);
}

static inline __attribute__((always_inline))
float4 itemCover(thread const int& i, thread float2& uv, thread const float& aspect, constant FlairUniforms& _111, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    int param = i;
    int2 ts = itemSize(param, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    bool _531 = ts.x > 1;
    bool _537;
    if (_531)
    {
        _537 = ts.y > 1;
    }
    else
    {
        _537 = _531;
    }
    if (_537)
    {
        float ta = float(ts.x) / float(ts.y);
        if (ta > aspect)
        {
            uv.x = (((uv.x - 0.5) * aspect) / ta) + 0.5;
        }
        else
        {
            uv.y = (((uv.y - 0.5) * ta) / aspect) + 0.5;
        }
    }
    int param_1 = i;
    float2 param_2 = uv;
    return itemAt(param_1, param_2, _111, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
}

static inline __attribute__((always_inline))
void drawPrint(thread float4& acc, thread const float2& p, thread const int& i, thread const float2& pos, thread const float& angle, thread const float& scale, thread const float& lift, thread const float& px, constant FlairUniforms& _111, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    float b = 0.0599999986588954925537109375;
    float ph = (1.0 - b) - 0.20000000298023223876953125;
    float pw = ph * _111.uAspect;
    float2 outer = float2((0.5 * pw) + b, 0.5);
    float param = -angle;
    float2 q = (rot2(param) * (p - pos)) / float2(_111.uPrint * scale);
    float qpx = px / (_111.uPrint * scale);
    float2 param_1 = q - (float2(0.0199999995529651641845703125, -0.02999999932944774627685546875) * (1.0 + (2.0 * lift)));
    float2 param_2 = outer;
    float param_3 = 0.00999999977648258209228515625;
    float sd = tileBox(param_1, param_2, param_3);
    float4 param_4 = acc;
    float3 param_5 = float3(0.0);
    float param_6 = (_111.uShadow * (0.449999988079071044921875 - (0.1500000059604644775390625 * lift))) * exp(-powr(fast::max(sd, 0.0) / (0.02999999932944774627685546875 + (0.0599999986588954925537109375 * lift)), 2.0));
    acc = over(param_4, param_5, param_6);
    float2 param_7 = q;
    float2 param_8 = outer;
    float param_9 = 0.008000000379979610443115234375;
    float d = tileBox(param_7, param_8, param_9);
    float cover = smoothstep(qpx, -qpx, d);
    if (cover <= 0.0)
    {
        return;
    }
    float4 param_10 = acc;
    float3 param_11 = float3(_111.uBorder) * (0.9700000286102294921875 + (0.02999999932944774627685546875 * q.y));
    float param_12 = cover;
    acc = over(param_10, param_11, param_12);
    float2 pc = float2(0.0, (0.5 - b) - (0.5 * ph));
    float2 param_13 = q - pc;
    float2 param_14 = float2(0.5 * pw, 0.5 * ph);
    float param_15 = 0.00200000009499490261077880859375;
    float photo = smoothstep(qpx, -qpx, tileBox(param_13, param_14, param_15));
    if (photo <= 0.0)
    {
        return;
    }
    int param_16 = i;
    float2 param_17 = ((q - pc) / float2(pw, ph)) + float2(0.5);
    float param_18 = _111.uAspect;
    float4 _741 = itemCover(param_16, param_17, param_18, _111, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    float4 pic = _741;
    float4 param_19 = acc;
    float3 param_20 = pic.xyz;
    float param_21 = photo * pic.w;
    acc = over(param_19, param_20, param_21);
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _111)
{
    float4 base = float4(float3(_111.uBackground) * _111.uBackgroundAlpha, _111.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _111, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    float2 p = (fragCoord - (float2(_111.iResolution[0], _111.iResolution[1]) * 0.5)) / float2(_111.iResolution[1u]);
    float px = 1.0 / _111.iResolution[1u];
    float aspect = _111.iResolution[0u] / _111.iResolution[1u];
    int n = clamp(_111.uCount, 1, 6);
    float fn = float(n);
    float tilt = radians(_111.uTilt);
    float start = ((_111.uDeal * float(n - 1)) + 0.60000002384185791015625) + 0.60000002384185791015625;
    float c = (_111.iTime - start) / fast::max(_111.uHold, 0.100000001490116119384765625);
    int _814;
    if (c >= 0.0)
    {
        _814 = int(mod(floor(c), float(n)));
    }
    else
    {
        _814 = -1;
    }
    int shown = _814;
    float f = fract(c);
    float _832;
    if (c >= 0.0)
    {
        float param = (f * _111.uHold) / 0.5;
        float _841 = ease(param);
        float param_1 = ((1.0 - f) * _111.uHold) / 0.5;
        float _849 = ease(param_1);
        _832 = _841 * _849;
    }
    else
    {
        _832 = 0.0;
    }
    float up = _832;
    float2 room = (fast::max(float2(aspect - (_111.uPrint * ((0.7400000095367431640625 * _111.uAspect) + 0.119999997317790985107421875)), 1.0 - _111.uPrint), float2(0.0)) * 0.5) * _111.uSpread;
    float4 acc = float4(0.0);
    float _924;
    for (int j = 0; j < 7; j++)
    {
        int i = (j < 6) ? j : shown;
        bool _893 = j < 6;
        bool _903;
        if (_893)
        {
            _903 = (j >= n) || (j == shown);
        }
        else
        {
            _903 = _893;
        }
        if (_903)
        {
            continue;
        }
        if (i < 0)
        {
            break;
        }
        float fi = float(i) + (_111.uSeed * 7.309999942779541015625);
        if (fn <= 1.0)
        {
            _924 = 0.5;
        }
        else
        {
            _924 = (float(i) + 0.5) / fn;
        }
        float across = _924;
        across = fract(((across * 0.618033885955810546875) * fn) + (0.17000000178813934326171875 * _111.uSeed));
        float param_2 = fi;
        float param_3 = fi + 3.7000000476837158203125;
        float2 pos = float2(((across * 2.0) - 1.0) + (((hash11(param_2) - 0.5) * 0.300000011920928955078125) / fn), (hash11(param_3) * 2.0) - 1.0) * room;
        float param_4 = fi + 9.1000003814697265625;
        float angle = ((hash11(param_4) * 2.0) - 1.0) * tilt;
        float param_5 = (_111.iTime - (_111.uDeal * float(i))) / 0.60000002384185791015625;
        float _989 = easeOut(param_5);
        float deal = _989;
        if (deal <= 0.0)
        {
            continue;
        }
        pos = mix(pos + float2(0.3499999940395355224609375, -1.2999999523162841796875), pos, float2(deal));
        angle += ((1.0 - deal) * 0.89999997615814208984375);
        float w = (i == shown) ? up : 0.0;
        float4 param_6 = acc;
        float2 param_7 = p;
        int param_8 = i;
        float2 param_9 = mix(pos, float2(0.0), float2(w));
        float param_10 = mix(angle, 0.0, w);
        float param_11 = mix(1.0, _111.uFocusScale, w);
        float param_12 = w;
        float param_13 = px;
        drawPrint(param_6, param_7, param_8, param_9, param_10, param_11, param_12, param_13, _111, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
        acc = param_6;
    }
    float4 param_14 = acc;
    fragColor = finish(param_14, _111);
}

fragment flair_photo_scatter_frag_out flair_photo_scatter_frag(constant FlairUniforms& _111 [[buffer(0)]], texture2d<float> uItem0 [[texture(1)]], texture2d<float> uItem1 [[texture(2)]], texture2d<float> uItem2 [[texture(3)]], texture2d<float> uItem3 [[texture(4)]], texture2d<float> uItem4 [[texture(5)]], texture2d<float> uItem5 [[texture(6)]], sampler uItem0Smplr [[sampler(1)]], sampler uItem1Smplr [[sampler(2)]], sampler uItem2Smplr [[sampler(3)]], sampler uItem3Smplr [[sampler(4)]], sampler uItem4Smplr [[sampler(5)]], sampler uItem5Smplr [[sampler(6)]], float4 gl_FragCoord [[position]])
{
    flair_photo_scatter_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1060;
    if (_111.flair_flipY > 0.5)
    {
        _1060 = _111.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1060 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1060);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _111, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

